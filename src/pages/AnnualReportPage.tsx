import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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
  Lock, Unlock, Plus, Trash2, RotateCcw
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
  const [selectedYear, setSelectedYear] = useState(currentYear);
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

  // ── Debounced field editing (prevents lag from per-keystroke DB writes) ──
  const [draftFields, setDraftFields] = useState<Record<string, any>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setField = useCallback((field: string, value: any, extras?: Record<string, any>) => {
    setDraftFields(prev => ({ ...prev, [field]: value, ...extras }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDraftFields(prev => {
        const updates = { ...prev };
        updateReport.mutate(updates as any);
        return {}; // clear draft after flush
      });
    }, 800);
  }, [updateReport]);

  // Flush on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Helper: get field value (draft takes priority over server)
  const getField = (field: keyof AnnualReport) => {
    return field in draftFields ? draftFields[field] : report?.[field];
  };

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

  // ── Financial metrics from frozen data (for variable substitution) ──
  const financialMetrics = useMemo(() => {
    const bs = (report?.frozen_bs_data as any[]) || [];
    const totalAssets = bs.filter((r: any) => r.section === 'assets' && r.type === 'total')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const totalLiabilities = bs.filter((r: any) => r.section === 'liabilities' && r.type === 'total')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const equityTotal = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const equityPrior = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.prior_year_balance || 0), 0);
    const currentAssets = bs.filter((r: any) => r.section === 'assets' && (r.row_code || '').startsWith('B') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const shortTermLiab = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('F') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const netIncome = report?.net_income || 0;
    const roe = equityTotal > 0 ? ((netIncome / equityTotal) * 100).toFixed(1) : '0.0';
    const liquidity = shortTermLiab > 0 ? (currentAssets / shortTermLiab).toFixed(2) : 'N/A';
    const equityChange = equityTotal >= equityPrior ? 'növekedett' : 'csökkent';
    const liquidityEval = Number(liquidity) >= 1.3 ? 'biztonsággal fedezik' : Number(liquidity) >= 1.0 ? 'éppen fedezik' : 'nem fedezik';
    return { totalAssets, totalLiabilities, equityTotal, equityPrior, equityChange, roe, liquidity, liquidityEval, netIncome };
  }, [report?.frozen_bs_data, report?.net_income]);

  // ── Dynamic variable replacement for notes templates ──
  const replaceVariables = (text: string): string => {
    const vars: Record<string, string> = {
      '[Cégnév]': selectedCompany?.name || '___',
      '[Székhely]': selectedCompany?.address || '___',
      '[Adószám]': selectedCompany?.tax_number || '___',
      '[Tárgyév]': String(selectedYear),
      '[Tárgyév+1]': String(selectedYear + 1),
      '[Képviselő neve]': report?.representative_name || '___',
      '[Képviselő beosztása]': report?.representative_role || 'ügyvezető',
      '[Saját tőke]': new Intl.NumberFormat('hu-HU').format(Math.round(financialMetrics.equityTotal / 1000)),
      '[Saját tőke változás]': financialMetrics.equityChange,
      '[Mérlegfőösszeg]': new Intl.NumberFormat('hu-HU').format(Math.round(financialMetrics.totalAssets / 1000)),
      '[ROE]': financialMetrics.roe,
      '[Likviditás]': financialMetrics.liquidity,
      '[Likviditás értékelés]': financialMetrics.liquidityEval,
      '[Adózott eredmény]': new Intl.NumberFormat('hu-HU').format(Math.round(financialMetrics.netIncome / 1000)),
      '[Osztalék]': new Intl.NumberFormat('hu-HU').format(Math.round((report?.dividend_amount || 0) / 1000)),
      '[Eredménytartalék]': new Intl.NumberFormat('hu-HU').format(Math.round((report?.retained_earnings || 0) / 1000)),
    };
    let result = text;
    for (const [key, val] of Object.entries(vars)) {
      result = result.replaceAll(key, val);
    }
    return result;
  };

  // ── Custom sections state ──
  const [newSectionTitle, setNewSectionTitle] = useState('');

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
      <div className="bg-muted/30 p-2 rounded-xl border border-border/50 print:hidden overflow-hidden">
        <div className="flex items-center gap-1">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all flex-1 min-w-0",
                    isActive ? "bg-primary text-primary-foreground shadow-lg" :
                    isDone ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" :
                    "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                    isActive ? "bg-primary-foreground/20" : isDone ? "bg-emerald-500/20" : "bg-muted"
                  )}>
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[11px] font-bold truncate">{step.id}. {step.title}</div>
                    <div className="text-[9px] opacity-70 truncate hidden xl:block">{step.description}</div>
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <Card className="border-border/60 shadow-md">
        <CardContent className="p-6 overflow-hidden">
          <div key={currentStep} className="step-animate">
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
                    value={getField('representative_name') || ''}
                    onChange={(e) => setField('representative_name', e.target.value)}
                    placeholder="pl. Kiss János"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Beosztás</Label>
                  <Input
                    value={getField('representative_role') || 'ügyvezető'}
                    onChange={(e) => setField('representative_role', e.target.value)}
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
                const rawText = saved?.text || tmpl.default_text;
                const text = replaceVariables(rawText);
                const isAssetSection = tmpl.section_key === 'asset_movement';
                const isEquitySection = tmpl.section_key === 'equity_changes';
                const isSalarySection = tmpl.section_key === 'employee_info';

                return (
                  <div key={tmpl.section_key} className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                      <span className="font-bold text-sm">{tmpl.section_title}</span>
                      <div className="flex items-center gap-2">
                        {saved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => {
                              const sections = ((report.notes_sections as any[]) || []).filter((s: any) => s.section_key !== tmpl.section_key);
                              updateReport.mutate({ notes_sections: sections } as any);
                              // Clear local draft too
                              setDraftFields(prev => {
                                const next = { ...prev };
                                delete next[`note_${tmpl.section_key}`];
                                return next;
                              });
                              toast({ title: 'Visszaállítva', description: `${tmpl.section_title} alapértelmezettre állítva.` });
                            }}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Alapértelmezett
                          </Button>
                        )}
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
                        value={(draftFields[`note_${tmpl.section_key}`] !== undefined) ? draftFields[`note_${tmpl.section_key}`] : (saved?.text || tmpl.default_text)}
                        rows={6}
                        className="text-sm"
                        onChange={(e) => {
                          const newText = e.target.value;
                          // Store locally for instant display
                          setDraftFields(prev => ({ ...prev, [`note_${tmpl.section_key}`]: newText }));
                          // Debounce the DB write
                          if (debounceRef.current) clearTimeout(debounceRef.current);
                          debounceRef.current = setTimeout(() => {
                            const sections = [...((report.notes_sections as any[]) || [])];
                            const idx = sections.findIndex((s: any) => s.section_key === tmpl.section_key);
                            const entry = { section_key: tmpl.section_key, text: newText };
                            if (idx >= 0) sections[idx] = entry; else sections.push(entry);
                            updateReport.mutate({ notes_sections: sections } as any);
                            setDraftFields(prev => {
                              const next = { ...prev };
                              delete next[`note_${tmpl.section_key}`];
                              return next;
                            });
                          }, 800);
                        }}
                      />

                      {/* Live preview with variables replaced */}
                      {(() => {
                        const currentText = (draftFields[`note_${tmpl.section_key}`] !== undefined)
                          ? draftFields[`note_${tmpl.section_key}`]
                          : (saved?.text || tmpl.default_text);
                        const hasVars = /\[.+?\]/.test(currentText);
                        if (!hasVars) return null;
                        return (
                          <div className="bg-muted/20 border border-border/30 rounded-lg p-3 mt-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                              <Info className="w-3 h-3" /> Előnézet (behelyettesített változókkal)
                            </p>
                            <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                              {replaceVariables(currentText)}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}

              {/* Custom sections added by user */}
              {((report.notes_sections as any[]) || []).filter((s: any) => s.is_custom).map((s: any) => (
                <div key={s.section_key} className="border border-border/50 rounded-xl overflow-hidden">
                  <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                    <span className="font-bold text-sm">{s.title || 'Egyéni szekció'}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => {
                        const sections = ((report.notes_sections as any[]) || []).filter((x: any) => x.section_key !== s.section_key);
                        updateReport.mutate({ notes_sections: sections } as any);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="p-4">
                    <Textarea
                      value={(draftFields[`note_${s.section_key}`] !== undefined) ? draftFields[`note_${s.section_key}`] : (s.text || '')}
                      rows={4}
                      className="text-sm"
                      onChange={(e) => {
                        const newText = e.target.value;
                        setDraftFields(prev => ({ ...prev, [`note_${s.section_key}`]: newText }));
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => {
                          const sections = [...((report.notes_sections as any[]) || [])];
                          const idx = sections.findIndex((x: any) => x.section_key === s.section_key);
                          if (idx >= 0) sections[idx] = { ...s, text: newText };
                          updateReport.mutate({ notes_sections: sections } as any);
                          setDraftFields(prev => {
                            const next = { ...prev };
                            delete next[`note_${s.section_key}`];
                            return next;
                          });
                        }, 800);
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Add custom section */}
              <div className="border-2 border-dashed border-border/40 rounded-xl p-4 flex items-center gap-3">
                <Input
                  placeholder="Új szekció címe (pl. Egyéb tájékoztatás)"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!newSectionTitle.trim()}
                  onClick={() => {
                    const key = `custom_${Date.now()}`;
                    const sections = [...((report.notes_sections as any[]) || []), {
                      section_key: key,
                      title: newSectionTitle.trim(),
                      text: '',
                      is_custom: true
                    }];
                    updateReport.mutate({ notes_sections: sections } as any);
                    setNewSectionTitle('');
                    toast({ title: 'Szekció hozzáadva', description: newSectionTitle.trim() });
                  }}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Hozzáadás
                </Button>
              </div>
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
                    value={getField('net_income') || 0}
                    onChange={(e) => {
                      const ni = Number(e.target.value);
                      setField('net_income', ni, { retained_earnings: ni - (getField('dividend_amount') || 0) });
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Osztalék (Ft)</Label>
                  <Input
                    type="number"
                    value={getField('dividend_amount') || 0}
                    onChange={(e) => {
                      const div = Number(e.target.value);
                      setField('dividend_amount', div, { retained_earnings: (getField('net_income') || 0) - div });
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Eredménytartalékba (Ft)</Label>
                  <Input value={getField('retained_earnings') || 0} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Határozat dátuma</Label>
                  <Input
                    type="date"
                    value={getField('dividend_resolution_date') || ''}
                    onChange={(e) => setField('dividend_resolution_date', e.target.value)}
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
          </div>{/* end step-animate wrapper */}
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
